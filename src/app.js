const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {Op} = require('sequelize');
const {getProfile} = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id',getProfile ,async (req, res) =>{
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const profileId = req.profile.id
    const contract = await Contract.findOne({where: {ClientId: profileId, ContractorId: id}})
    if(!contract) return res.status(404).end()
    res.json(contract)
})

/**
 * @returns list of non terminated contracts
 */
 app.get('/contracts',getProfile ,async (req, res) =>{
    const {Contract} = req.app.get('models')
    const {id} = req.profile
    const contracts = await Contract.findAll({
        where: {
            ClientId: id,
            status: {
                [Op.ne]: 'terminated'
            }
        }
      });
    if(!contracts) return res.status(404).end()
    res.json(contracts)
})

/**
 * @returns all unpaid jobs for a user for active contracts only
 */
 app.get('/jobs/unpaid',getProfile ,async (req, res) =>{
    const {Contract, Job} = req.app.get('models')
    const {id} = req.profile
    const jobs = await Job.findAll({
        include: [
          {
            model: Contract,
            where: {
                status: 'in_progress',
                ClientId: id,
            }
          }
        ],
        where: {
            paid: null
        }
      });
    if(!jobs) return res.status(404).end()
    res.json(jobs)
})

/**
 * @returns pay for a job if his balance >= the amount to pay
 */
 app.post('/jobs/:job_id/pay',getProfile ,async (req, res) =>{
    const {Contract, Job, Profile} = req.app.get('models')
    let status = false
    const {id} = req.profile
    const {job_id} = req.params
    const profile = await Profile.findOne({where: {id}})
    const output = await Job.findOne({
        include: [
          {
            model: Contract,
            where: {
                ClientId: id,
            }
          }
        ],
        where: {
            id: job_id
        }
      });
    if(!output) return res.status(404).end()
    if (profile.dataValues.balance >= jobs.dataValues.price) {
        await Profile.update(
            { balance: profile.dataValues.balance - jobs.dataValues.price },
            { where: { id } }
          )
          await Profile.update(
            { balance: profile.dataValues.balance + jobs.dataValues.price },
            { where: { id: jobs.dataValues.Contract.ContractorId } }
          )
        status = true
    }
    res.json(status)
})

/**
 * @returns deposit money in to client balance
 */
 app.post('/balances/deposit/:userId',getProfile ,async (req, res) =>{
    const {Contract, Job, Profile} = req.app.get('models')
    const {userId} = req.params
    const profile = await Profile.findOne({where: {id: userId}})
    const jobs = await Job.findAll({
        include: [
          {
            model: Contract,
            where: {
                ClientId: userId,
            }
          }
        ],
        where: {
            paid: null
        }
      });
    
    if(!jobs) return res.status(404).end()
    let total = 0
    let status = false
    jobs.map(j => {
        total = total + j.price
    })
    const toDeposit = ((25/ 100) * total).toFixed(2)
    await Profile.update(
        { balance:  Number(profile.dataValues.balance) + Number(toDeposit)},
        { where: { id: userId } }
      )
    status = true
    res.json(status)
})

/*
 * @returns Returns the profession that earned the most money
 */
 app.get('/admin/best-profession',getProfile ,async (req, res) =>{
    const {Contract, Job, Profile} = req.app.get('models')
    let startDate = req.query.start
    let endDate = req.query.end
    const jobs = await Job.findAll({
        where: {
            paid: true,
            paymentDate: {
                [Op.between]: [startDate, endDate]
            }
        }
      });
    if(!jobs) return res.status(404).end()
    
    let resObj = {}
    jobs.map(j => {
        if (resObj[j.ContractId]) {
            resObj[j.ContractId] =  {
                total: resObj[j.ContractId].total + j.price
            }
        } else {
            resObj[j.ContractId] =  {
                total: j.price
            }
        }
    })
    const vals = Object.values(resObj);
    const validArray = []
    vals.map(v => {
        validArray.push(v.total)
    })
    let maxValueIndex = validArray.indexOf(Math.max(...validArray));
    const keyIndex = Object.keys(resObj)
    const contract = await Contract.findOne({where: {id: keyIndex[maxValueIndex]}})
    const profile = await Profile.findOne({where: {id: contract.ContractorId}})
    res.json(profile)
})

/**
 * @returns clients that paid the most for jobs in the query time period and limit
 */
 app.get('/admin/best-clients',getProfile ,async (req, res) =>{
    const {Contract, Job, Profile} = req.app.get('models')
    const startDate = req.query.start
    const endDate = req.query.end
    const limit = req.query.limit
    const jobs = await Job.findAll({
        include: [{
            model: Contract,
        }],
        where: {
            paid: true,
            paymentDate: {
                [Op.between]: [startDate, endDate]
            }
        }, limit: limit < 2 ? 2 : limit
      });
    
    if(!jobs) return res.status(404).end()

    const pendingPromises = jobs.map(async(j) => {
        let client = await Profile.findOne({where: {id: j.Contract.ClientId}})
        return client.dataValues.firstName + client.dataValues.lastName
    })

    Promise.all(pendingPromises).then((c) => {
        let uniqueItems = [...new Set(c)]
        res.json(uniqueItems)
      }).catch(err => {
        res.status(404).end()
      });
})

module.exports = app;
